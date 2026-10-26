// Allegro Standard — the planning DSL, wiring and the graph checks (B-151 stage A2)
// The full `SoftwareRelease` worked example of docs/book/vivace/planning-dsl.md
// §5, built through the library's API, checked (§7), and then five plans each
// broken in one way, refused in planning vocabulary. Both enforcement shapes:
// `validate` yields an error VALUE; a `WellFormedPlan` annotation halts.
use planning

// --- Fixtures (convention 11): readable names backed by predicates --------
signed    = fixture("signed_and_version_stamped", a => true)
tagged    = fixture("tagged_with_version", a => true)
semver    = fixture("valid_semver", v => true)
matches   = fixture("version_matches_release_version", r => true)
all_pass  = fixture("all_tests_pass", r => true)
capable   = fixture("traffic_handling_capable", h => true)

// --- BuildPipeline, declared separately and referenced with `uses` ----------
build_pipeline = plan_with_handler(
  plan("BuildPipeline",
       [port("SourceCommit"), port("ReleaseVersion")],
       [port_where("BuildArtifacts", signed)],
       [leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]),
        leaf("Package", [port("CompiledBinaries"), port("ReleaseVersion")], [port_where("PackagedArtifacts", tagged)]),
        leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")])]),
  handler_retry(handler("CompilationError", [
    leaf("Diagnose", [port("SourceCommit")], [port("Diagnosis")]),
    leaf("ApplyFix", [port("Diagnosis"), port("SourceCommit")], [port("PatchedCommit")]),
    leaf("Rebuild", [port("PatchedCommit"), port("ReleaseVersion")], [port("BuildArtifacts")])]), retry(3)))

// --- SoftwareRelease: three deep in the Deploy branch -----------------------
test = composite("Test", [port("BuildArtifacts")], [port("ValidatedBuild")], [
  leaf("UnitTests", [port("BuildArtifacts")], [port_where("UnitTestResults", all_pass)]),
  leaf("IntegrationTests", [port("BuildArtifacts")], [port_where("IntegrationResults", all_pass)]),
  leaf("SmokeTests", [port("BuildArtifacts")], [port_where("SmokeResults", all_pass)]),
  leaf("Validate", [port("UnitTestResults"), port("IntegrationResults"), port("SmokeResults")], [port("ValidatedBuild")])])

production = with_handler(
  composite("Production", [port("ValidatedStaging")], [port("DeployedRelease")], [
    leaf("BlueDeploy", [port("ValidatedStaging")], [port("BlueEnvironmentReady")]),
    with_retry(leaf("HealthCheck", [port("BlueEnvironmentReady")], [port_where("BlueHealthy", capable)]), retry_backoff(5, "30s")),
    with_instructions(leaf("Cutover", [port("BlueHealthy")], [port("DeployedRelease")]),
      "Switch load balancer to route 100% of traffic to blue.")]),
  handler("HealthCheckFailed", [
    with_instructions(leaf("Rollback", [port("BlueEnvironmentReady")], [port("DeployedRelease")]),
      "Tear down blue deployment, leave green serving traffic. Raise DeploymentFailure to caller.")]))

deploy = composite("Deploy", [port("ApprovedRelease")], [port("DeployedRelease")], [
  leaf("StagingDeploy", [port("ApprovedRelease")], [port("StagedRelease")]),
  leaf("StagingValidation", [port("StagedRelease")], [port("ValidatedStaging")]),
  production])

release = with_budget(
  plan("SoftwareRelease",
       [port("SourceCommit"), port_where("ReleaseVersion", semver), port("ReleaseApproval")],
       [port_where("DeployedRelease", matches)],
       [uses("Build", build_pipeline),
        test,
        leaf("ReleaseReview", [port("ValidatedBuild"), port("ReleaseApproval")], [port("ApprovedRelease")]),
        deploy]),
  effort_budget(person_hours(200)))

print(plan_show(release))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 14 nodes, 10 leaves, 1 handlers

// --- The checks pass: wiring, compatibility, acyclicity, outcomes, every
//     composite's inner graph, and the borrowed plan's own --------------------
print(plan_errors(release))
// expect: []

print(well_formed(release))
// expect: true

// Construction-path enforcement: `validate` answers the plan itself.
print(validate(release).name)
// expect: SoftwareRelease

// Annotation-path enforcement: the binding type checks, or compilation halts.
ok: WellFormedPlan = release
print(ok.name)
// expect: SoftwareRelease

print(release instanceof WellFormedPlan)
// expect: true

// --- Five plans, each broken in one way ----------------------------------
// 1. An input nobody produces (and, as a consequence, an outcome nobody uses).
unwired = plan("Unwired", [port("SourceCommit")], [port("BuildArtifacts")], [
  leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]),
  leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")])])
print(plan_errors(unwired))
// expect: [input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs, outcome CompiledBinaries of Compile is neither consumed by a node of Unwired nor declared as its outcome]

print(unwired instanceof WellFormedPlan)
// expect: false

refused = validate(unwired)
print(error of refused)
// expect: Unwired is not well-formed: input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs

// 2. A cycle: A needs what B produces and B needs what A produces.
cyclic = plan("Cyclic", [], [port("X")], [
  leaf("A", [port("Y")], [port("X")]),
  leaf("B", [port("X")], [port("Y")])])
print(plan_errors(cyclic))
// expect: [cycle through A, B in Cyclic]

// 3. Two producers of one type (convention 5 wires by type), and a declared
//    outcome no node produces.
ambiguous = plan("Ambiguous", [port("In")], [port("Fin"), port("Never")], [
  leaf("C1", [port("In")], [port("Out")]),
  leaf("C2", [port("In")], [port("Out")]),
  leaf("C3", [port("Out")], [port("Fin")])])
print(plan_errors(ambiguous))
// expect: [input Out of C3 is ambiguous: produced by C1 and C2, outcome Never of Ambiguous is declared but no node produces it]

// 4. A constrained input whose producer does not promise the constraint.
unpromised = plan("Unpromised", [port("CompiledBinaries")], [port("BuildArtifacts")], [
  leaf("Package", [port("CompiledBinaries")], [port("PackagedArtifacts")]),
  leaf("Sign", [port_where("PackagedArtifacts", tagged)], [port("BuildArtifacts")])])
print(plan_errors(unpromised))
// expect: [input PackagedArtifacts [tagged_with_version] of Sign requires tagged_with_version, but Package provides PackagedArtifacts unconstrained]

// 5. A composite whose declared outcome its inner graph does not produce
//    (convention 6): the checks apply inside every composite.
thin_test = composite("Test", [port("BuildArtifacts")], [port("ValidatedBuild")], [
  leaf("UnitTests", [port("BuildArtifacts")], [port("UnitTestResults")])])
nested = plan("Nested", [port("BuildArtifacts")], [port("ValidatedBuild")], [thin_test])
print(plan_errors(nested))
// expect: [outcome ValidatedBuild of Test is declared but no node produces it, outcome UnitTestResults of UnitTests is neither consumed by a node of Test nor declared as its outcome]
