// Allegro Standard — the planning DSL, estimates and budgets (B-151 stage A3)
// The worked example of docs/book/vivace/planning-dsl.md §5 with every
// estimate and retry it declares. Durations are the units DSL's quantities
// (ruling R2); effort and money are the planning library's own measures
// (ruling R1). Estimates roll up with retry upper bounds (convention 12);
// a budget is a check like any other (convention 8), refused in planning
// vocabulary, and a wrong measure is refused in the units DSL's.
use units
use planning

signed    = fixture("signed_and_version_stamped", a => true)
tagged    = fixture("tagged_with_version", a => true)
semver    = fixture("valid_semver", v => true)
matches   = fixture("version_matches_release_version", r => true)
all_pass  = fixture("all_tests_pass", r => true)
capable   = fixture("traffic_handling_capable", h => true)

// --- The measures --------------------------------------------------------
print((person_hours(1) + person_hours(0.5)).toString())
// expect: 1.5 person-hours

print((money(1500, "USD") + money(200, "USD")).toString())
// expect: 1700 USD

print(estimate_show(est(30 min, person_hours(1), none)))
// expect: duration 30 min, effort 1 person-hours, money none

// A measure of the wrong kind is refused where it is written.
print(error of est(3 m, none, none))
// expect: a duration is a time quantity such as 30 min, not a length quantity (3 m)

print(error of est(30 min, 2 h, none))
// expect: effort is measured in person-hours (person_hours(n)), not a time quantity (2 h)

print(error of est(30, none, none))
// expect: a duration is a time quantity such as 30 min, not a bare number

print(error of (person_hours(1) + money(5, "USD")))
// expect: cannot add money to effort: effort is measured in person-hours

print(error of (money(1, "USD") + money(1, "EUR")))
// expect: cannot add EUR to USD: one currency per plan

// --- BuildPipeline with its estimates --------------------------------------
build_pipeline = plan_with_handler(
  plan("BuildPipeline",
       [port("SourceCommit"), port("ReleaseVersion")],
       [port_where("BuildArtifacts", signed)],
       [with_failure(with_estimate(leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]), est(30 min, person_hours(1), none)), "CompilationError"),
        with_estimate(leaf("Package", [port("CompiledBinaries"), port("ReleaseVersion")], [port_where("PackagedArtifacts", tagged)]), est(15 min, person_hours(0.5), none)),
        with_estimate(leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")]), est(5 min, person_hours(0.25), none))]),
  handler_retry(handler("CompilationError", [
    with_estimate(leaf("Diagnose", [port("SourceCommit")], [port("Diagnosis")]), est(1 h, person_hours(1), none)),
    with_estimate(leaf("ApplyFix", [port("Diagnosis"), port("SourceCommit")], [port("PatchedCommit")]), est(3 h, person_hours(3), none)),
    with_estimate(leaf("Rebuild", [port("PatchedCommit"), port("ReleaseVersion")], [port("BuildArtifacts")]), est(1 h, person_hours(1), none))]), retry(3)))

print(estimate_show(rollup(build_pipeline)))
// expect: duration 50 min, effort 1.75 person-hours, money none

// --- SoftwareRelease ------------------------------------------------------
test = composite("Test", [port("BuildArtifacts")], [port("ValidatedBuild")], [
  with_estimate(leaf("UnitTests", [port("BuildArtifacts")], [port_where("UnitTestResults", all_pass)]), est(20 min, none, none)),
  with_estimate(leaf("IntegrationTests", [port("BuildArtifacts")], [port_where("IntegrationResults", all_pass)]), est(1 h, none, none)),
  with_estimate(leaf("SmokeTests", [port("BuildArtifacts")], [port_where("SmokeResults", all_pass)]), est(30 min, none, none)),
  leaf("Validate", [port("UnitTestResults"), port("IntegrationResults"), port("SmokeResults")], [port("ValidatedBuild")])])

production = with_handler(
  composite("Production", [port("ValidatedStaging")], [port("DeployedRelease")], [
    with_estimate(leaf("BlueDeploy", [port("ValidatedStaging")], [port("BlueEnvironmentReady")]), est(15 min, person_hours(0.5), none)),
    with_retry(with_failure(with_estimate(leaf("HealthCheck", [port("BlueEnvironmentReady")], [port_where("BlueHealthy", capable)]), est(10 min, person_hours(0.25), none)), "HealthCheckFailed"), retry_backoff(5, 30 s)),
    with_instructions(with_estimate(leaf("Cutover", [port("BlueHealthy")], [port("DeployedRelease")]), est(5 min, person_hours(0.25), none)),
      "Switch load balancer to route 100% of traffic to blue.")]),
  handler("HealthCheckFailed", [
    with_estimate(leaf("Rollback", [port("BlueEnvironmentReady")], [port("DeployedRelease")]), est(5 min, person_hours(0.25), none))]))

deploy = composite("Deploy", [port("ApprovedRelease")], [port("DeployedRelease")], [
  with_estimate(leaf("StagingDeploy", [port("ApprovedRelease")], [port("StagedRelease")]), est(30 min, person_hours(1), none)),
  with_estimate(leaf("StagingValidation", [port("StagedRelease")], [port("ValidatedStaging")]), est(1 h, person_hours(2), none)),
  production])

review = with_estimate(leaf("ReleaseReview", [port("ValidatedBuild"), port("ReleaseApproval")], [port("ApprovedRelease")]), est(2 h, person_hours(2), none))

release_plan(deploy_node) =>
  plan("SoftwareRelease",
       [port("SourceCommit"), port_where("ReleaseVersion", semver), port("ReleaseApproval")],
       [port_where("DeployedRelease", matches)],
       [uses("Build", build_pipeline), test, review, deploy_node])

release = with_budget(release_plan(deploy), effort_budget(person_hours(200)))

print(budget_show(release.budget))
// expect: budget duration none, effort 200 person-hours, money none

// The rollup: leaves through composites and the borrowed plan, durations
// serial, a retried node at max_attempts times its estimate.
print(estimate_show(node_rollup(find_node(release, "HealthCheck"))))
// expect: duration 50 min, effort 1.25 person-hours, money none

print(estimate_show(node_rollup(find_node(release, "Production"))))
// expect: duration 70 min, effort 2 person-hours, money none

print(estimate_show(rollup(release)))
// expect: duration 440 min, effort 8.75 person-hours, money none

// The budget is discharged with the rest of the checks.
print(plan_errors(release))
// expect: []

ok: WellFormedPlan = release
print(ok.name)
// expect: SoftwareRelease

// --- Budgets refused ----------------------------------------------------------
// At the plan: the worked example under a budget it exceeds. The budget is
// checked against the BOUND (stage A4): the main graph's 8.75 person-hours
// plus the handlers' graphs at their retry (15 for the CompilationError
// recovery at three attempts, 0.25 for the rollback).
tight = with_budget(release_plan(deploy), effort_budget(person_hours(8)))
print(plan_errors(tight))
// expect: [budget of SoftwareRelease: effort 24 person-hours exceeds 8 person-hours]

print(error of validate(tight))
// expect: SoftwareRelease is not well-formed: budget of SoftwareRelease: effort 24 person-hours exceeds 8 person-hours

print(tight instanceof WellFormedPlan)
// expect: false

// At a composite, in a different unit of the same dimension (160 min of
// main graph, 5 min of rollback).
rushed = release_plan(with_budget(deploy, duration_budget(2 h)))
print(plan_errors(rushed))
// expect: [budget of Deploy: duration 165 min exceeds 2 h]

// Money rolls up the same way, with the currency carried.
hire = with_budget(
  plan("Hire", [port("Requisition")], [port("Hired")], [
    with_estimate(leaf("Post", [port("Requisition")], [port("Posting")]), est(none, none, money(500, "USD"))),
    with_retry(with_estimate(leaf("Interview", [port("Posting")], [port("Hired")]), est(4 h, person_hours(8), money(300, "USD"))), retry(3))]),
  money_budget(money(1000, "USD")))
print(estimate_show(rollup(hire)))
// expect: duration 12 h, effort 24 person-hours, money 1400 USD

print(plan_errors(hire))
// expect: [budget of Hire: money 1400 USD exceeds 1000 USD]

// A budget that is not a budget is refused at the builder.
print(error of with_budget(release, 200))
// expect: a budget is built with budget(duration, effort, money), not a bare number
