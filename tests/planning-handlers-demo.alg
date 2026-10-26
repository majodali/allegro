// Allegro Standard — the planning DSL, failures and handlers (B-151 stage A4)
// The worked example of docs/book/vivace/planning-dsl.md §5 with its two
// handlers checked as graphs: a failure a node declares propagates to the
// nearest scope with a handler for it (convention 9); the handler's graph
// is wired from what the scope had at the failure and must produce the
// scope's outcomes; the budget bound includes every handler at its retry.
use units
use planning

signed    = fixture("signed_and_version_stamped", a => true)
tagged    = fixture("tagged_with_version", a => true)
semver    = fixture("valid_semver", v => true)
matches   = fixture("version_matches_release_version", r => true)
all_pass  = fixture("all_tests_pass", r => true)
capable   = fixture("traffic_handling_capable", h => true)

// --- BuildPipeline: Compile can fail with CompilationError ------------------
compile = with_failure(with_estimate(leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]), est(30 min, person_hours(1), none)), "CompilationError")
package = with_estimate(leaf("Package", [port("CompiledBinaries"), port("ReleaseVersion")], [port_where("PackagedArtifacts", tagged)]), est(15 min, person_hours(0.5), none))
sign    = with_estimate(leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")]), est(5 min, person_hours(0.25), none))

diagnose  = with_estimate(leaf("Diagnose", [port("SourceCommit")], [port("Diagnosis")]), est(1 h, person_hours(1), none))
apply_fix = with_estimate(leaf("ApplyFix", [port("Diagnosis"), port("SourceCommit")], [port("PatchedCommit")]), est(3 h, person_hours(3), none))
rebuild   = with_estimate(leaf("Rebuild", [port("PatchedCommit"), port("ReleaseVersion")], [port("BuildArtifacts")]), est(1 h, person_hours(1), none))

build_plan(handler_nodes) =>
  plan_with_handler(
    plan("BuildPipeline", [port("SourceCommit"), port("ReleaseVersion")], [port_where("BuildArtifacts", signed)], [compile, package, sign]),
    handler_retry(handler("CompilationError", handler_nodes), retry(3)))

build_pipeline = build_plan([diagnose, apply_fix, rebuild])

// --- SoftwareRelease: HealthCheck can fail with HealthCheckFailed ------------
test = composite("Test", [port("BuildArtifacts")], [port("ValidatedBuild")], [
  with_estimate(leaf("UnitTests", [port("BuildArtifacts")], [port_where("UnitTestResults", all_pass)]), est(20 min, none, none)),
  with_estimate(leaf("IntegrationTests", [port("BuildArtifacts")], [port_where("IntegrationResults", all_pass)]), est(1 h, none, none)),
  with_estimate(leaf("SmokeTests", [port("BuildArtifacts")], [port_where("SmokeResults", all_pass)]), est(30 min, none, none)),
  leaf("Validate", [port("UnitTestResults"), port("IntegrationResults"), port("SmokeResults")], [port("ValidatedBuild")])])

blue_deploy  = with_estimate(leaf("BlueDeploy", [port("ValidatedStaging")], [port("BlueEnvironmentReady")]), est(15 min, person_hours(0.5), none))
health_check = with_retry(with_failure(with_estimate(leaf("HealthCheck", [port("BlueEnvironmentReady")], [port_where("BlueHealthy", capable)]), est(10 min, person_hours(0.25), none)), "HealthCheckFailed"), retry_backoff(5, 30 s))
cutover      = with_estimate(leaf("Cutover", [port("BlueHealthy")], [port("DeployedRelease")]), est(5 min, person_hours(0.25), none))

production_plain = composite("Production", [port("ValidatedStaging")], [port("DeployedRelease")], [blue_deploy, health_check, cutover])

rollback = with_estimate(leaf("Rollback", [port("BlueEnvironmentReady")], [port("DeployedRelease")]), est(5 min, person_hours(0.25), none))

production = with_handler(production_plain, handler("HealthCheckFailed", [rollback]))

deploy_with(prod) =>
  composite("Deploy", [port("ApprovedRelease")], [port("DeployedRelease")], [
    with_estimate(leaf("StagingDeploy", [port("ApprovedRelease")], [port("StagedRelease")]), est(30 min, person_hours(1), none)),
    with_estimate(leaf("StagingValidation", [port("StagedRelease")], [port("ValidatedStaging")]), est(1 h, person_hours(2), none)),
    prod])

review = with_estimate(leaf("ReleaseReview", [port("ValidatedBuild"), port("ReleaseApproval")], [port("ApprovedRelease")]), est(2 h, person_hours(2), none))

release_with(build, review_node, deploy_node) =>
  plan("SoftwareRelease",
       [port("SourceCommit"), port_where("ReleaseVersion", semver), port("ReleaseApproval")],
       [port_where("DeployedRelease", matches)],
       [uses("Build", build), test, review_node, deploy_node])

release = with_budget(release_with(build_pipeline, review, deploy_with(production)), effort_budget(person_hours(200)))

// --- Escalation is a property of the graph ----------------------------------
print(escalations(release))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

print(unhandled_failures(release))
// expect: []

// Both handlers check as graphs: wired from what the scope had when the
// failure occurred, producing the scope's outcome.
print(plan_errors(release))
// expect: []

ok: WellFormedPlan = release
print(handler_count(ok) + handler_count(build_pipeline))
// expect: 2

// --- What the handlers add to the bound --------------------------------------
print(estimate_show(rollup(release)))
// expect: duration 440 min, effort 8.75 person-hours, money none

print(estimate_show(rollup_bound(release)))
// expect: duration 1345 min, effort 24 person-hours, money none

// The main graph fits in 20 person-hours; the recovery paths do not.
print(plan_errors(with_budget(release_with(build_pipeline, review, deploy_with(production)), effort_budget(person_hours(20)))))
// expect: [budget of SoftwareRelease: effort 24 person-hours exceeds 20 person-hours]

// --- A failure nobody handles escalates to the caller: a property, not a
//     finding, since a plan may fail by design ---------------------------------
strict_review = with_failure(review, "ReviewRejected")
reviewed = release_with(build_pipeline, strict_review, deploy_with(production))
print(unhandled_failures(reviewed))
// expect: [ReviewRejected]

print(escalations(reviewed)[1])
// expect: ReviewRejected raised by ReleaseReview escalates to the caller of SoftwareRelease

print(plan_errors(reviewed))
// expect: []

// A failure raised inside a recovery escalates past the scope it recovers.
fragile_build = build_plan([diagnose, apply_fix, with_failure(rebuild, "RebuildFailed")])
print(unhandled_failures(fragile_build))
// expect: [RebuildFailed]

print(escalations(release_with(fragile_build, review, deploy_with(production)))[1])
// expect: RebuildFailed raised by Rebuild escalates to the caller of SoftwareRelease

// --- A handler higher up catches what escapes a composite --------------------
//     Production without its handler raises HealthCheckFailed to Deploy, whose
//     handler may consume what Deploy had produced by then.
redeploy = leaf("Redeploy", [port("ValidatedStaging")], [port("DeployedRelease")])
careful_deploy = with_handler(deploy_with(production_plain), handler("HealthCheckFailed", [redeploy]))
caught_above = release_with(build_pipeline, review, careful_deploy)
print(escalations(caught_above)[1])
// expect: HealthCheckFailed raised by HealthCheck is handled in Deploy

print(plan_errors(caught_above))
// expect: []

// --- Handlers refused ----------------------------------------------------------
// 1. A handler for a failure no node beneath the scope declares.
small = plan_with_handler(
  plan("Small", [port("In")], [port("Out")], [leaf("Work", [port("In")], [port("Out")])]),
  handler("Nope", [leaf("Fallback", [port("In")], [port("Out")])]))
print(plan_errors(small))
// expect: [handler on Nope in Small: no node beneath Small raises Nope]

// 2. A handler whose graph does not produce the scope's outcome.
green_kept = with_handler(production_plain, handler("HealthCheckFailed", [leaf("Rollback", [port("BlueEnvironmentReady")], [port("GreenKept")])]))
print(plan_errors(release_with(build_pipeline, review, deploy_with(green_kept))))
// expect: [outcome DeployedRelease of Production/on HealthCheckFailed is declared but no node produces it, outcome GreenKept of Rollback is neither consumed by a node of Production/on HealthCheckFailed nor declared as its outcome]

// 3. A handler that consumes what the failing node would have produced.
too_late = with_handler(production_plain, handler("HealthCheckFailed", [leaf("Rollback", [port("BlueHealthy")], [port("DeployedRelease")])]))
print(plan_errors(release_with(build_pipeline, review, deploy_with(too_late))))
// expect: [input BlueHealthy of Rollback is not produced by any node of Production/on HealthCheckFailed or by its inputs]

refused = validate(release_with(build_pipeline, review, deploy_with(too_late)))
print(error of refused)
// expect: SoftwareRelease is not well-formed: input BlueHealthy of Rollback is not produced by any node of Production/on HealthCheckFailed or by its inputs
