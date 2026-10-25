// Allegro Standard — the planning DSL, library core (B-151 stage A1)
// The `BuildPipeline` sub-plan of the worked example in
// docs/book/vivace/planning-dsl.md §5, built by hand through the library's
// API: no surface syntax yet (stage B), no graph checks yet (stage A2).
// A plan is a graph of OUTCOMES; dependencies are derived from wiring.
use planning

// --- Fixtures: convention 11 — a readable name backed by a predicate -----
signed = fixture("signed_and_version_stamped", a => true)
tagged = fixture("tagged_with_version", a => true)

// --- Leaves: typed inputs and outcomes, an estimate ----------------------
compile = with_estimate(
  leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]),
  est(30, 1, none))
package = with_estimate(
  leaf("Package", [port("CompiledBinaries"), port("ReleaseVersion")], [port_where("PackagedArtifacts", tagged)]),
  est(15, 0.5, none))
sign = with_estimate(
  leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")]),
  est(5, 0.25, none))

// --- A failure handler: an alternate graph producing the same outcome ----
diagnose  = leaf("Diagnose", [port("SourceCommit")], [port("Diagnosis")])
apply_fix = leaf("ApplyFix", [port("Diagnosis"), port("SourceCommit")], [port("PatchedCommit")])
rebuild   = leaf("Rebuild", [port("PatchedCommit"), port("ReleaseVersion")], [port("BuildArtifacts")])
on_compile_error = handler_retry(handler("CompilationError", [diagnose, apply_fix, rebuild]), retry(3))

// --- The plan ------------------------------------------------------------
build_pipeline = plan_with_handler(
  plan("BuildPipeline",
       [port("SourceCommit"), port("ReleaseVersion")],
       [port_where("BuildArtifacts", signed)],
       [compile, package, sign]),
  on_compile_error)

print(plan_show(build_pipeline))
// expect: plan BuildPipeline: SourceCommit, ReleaseVersion -> BuildArtifacts [signed_and_version_stamped]; 3 nodes, 3 leaves, 1 handlers

print(node_show(compile))
// expect: Compile (leaf): SourceCommit -> CompiledBinaries

print(node_show(package))
// expect: Package (leaf): CompiledBinaries, ReleaseVersion -> PackagedArtifacts [tagged_with_version]

print(node_names(build_pipeline))
// expect: [Compile, Package, Sign]

print(estimate_show(compile.estimate))
// expect: duration 30, effort 1, money none

print(estimate_show(diagnose.estimate))
// expect: no estimate

print(find_node(build_pipeline, "Sign").name)
// expect: Sign

print(find_node(build_pipeline, "Nope"))
// expect: none

print(build_pipeline.handlers[0].failure)
// expect: CompilationError

print(build_pipeline.handlers[0].retry.max_attempts)
// expect: 3

print(build_pipeline.handlers[0].nodes.length)
// expect: 3

// --- Composites and `uses` (convention 10) --------------------------------
test = composite("Test", [port("BuildArtifacts")], [port("ValidatedBuild")], [
  leaf("UnitTests", [port("BuildArtifacts")], [port("UnitTestResults")]),
  leaf("Validate", [port("UnitTestResults")], [port("ValidatedBuild")])])
build = uses("Build", build_pipeline)

print(node_show(build))
// expect: Build (uses): SourceCommit, ReleaseVersion -> BuildArtifacts [signed_and_version_stamped]

print(node_kind(build))
// expect: uses

print(node_kind(test))
// expect: composite

release = plan("SoftwareRelease",
  [port("SourceCommit"), port("ReleaseVersion"), port("ReleaseApproval")],
  [port("DeployedRelease")],
  [build, test])

print(plan_show(release))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion, ReleaseApproval -> DeployedRelease; 4 nodes, 2 leaves, 0 handlers

print(node_names(release))
// expect: [Build, Test, UnitTests, Validate]

// --- Plans are values: structural equality, declared types ---------------
again = plan("SoftwareRelease",
  [port("SourceCommit"), port("ReleaseVersion"), port("ReleaseApproval")],
  [port("DeployedRelease")],
  [build, test])

print(release == again)
// expect: true

print(release == build_pipeline)
// expect: false

print(release instanceof Plan)
// expect: true

print(compile instanceof PlanNode)
// expect: true
