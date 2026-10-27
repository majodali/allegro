// Rung 3, scene 1 — the model is the artifact, and it checks itself.
//
// A domain model, not a program: a project plan as a graph of OUTCOMES.
// The planning DSL is a pure Allegro library (lib/planning.alg) with an
// offside-rule grammar block; `plan NAME:` declares NAME as a
// WellFormedPlan, so a plan that does not check does not build. Every
// refusal is written in planning vocabulary, because the model's own
// well-formedness predicate says why it refused (stage C1).
use units
use planning

// Fixtures: a readable phrase backed by a predicate (convention 11).
signed_and_version_stamped      = fixture("signed_and_version_stamped", a => true)
tagged_with_version             = fixture("tagged_with_version", a => true)
valid_semver                    = fixture("valid_semver", v => true)
version_matches_release_version = fixture("version_matches_release_version", r => true)
all_tests_pass                  = fixture("all_tests_pass", r => true)
traffic_handling_capable        = fixture("traffic_handling_capable", h => true)

// A sub-plan: inputs and outcomes with constraints, estimates on leaves,
// a declared failure, and a recovery graph for it with a retry policy.
plan BuildPipeline:
  inputs:   SourceCommit, ReleaseVersion
  outcomes: BuildArtifacts [ signed_and_version_stamped ]

  Compile:
    inputs:   SourceCommit
    outcomes: CompiledBinaries
    estimate: 30 min, 1 person-hour
    fails:    CompilationError

  Package:
    inputs:   CompiledBinaries, ReleaseVersion
    outcomes: PackagedArtifacts [ tagged_with_version ]
    estimate: 15 min, 0.5 person-hours

  Sign:
    inputs:   PackagedArtifacts
    outcomes: BuildArtifacts
    estimate: 5 min, 0.25 person-hours

  on CompilationError:
    retry: max 3 attempts
    Diagnose:
      inputs:   SourceCommit
      outcomes: Diagnosis
      estimate: 1 hour, 1 person-hour
    ApplyFix:
      inputs:   Diagnosis, SourceCommit
      outcomes: PatchedCommit
      estimate: 3 hours, 3 person-hours
    Rebuild:
      inputs:   PatchedCommit, ReleaseVersion
      outcomes: BuildArtifacts
      estimate: 1 hour, 1 person-hour

// The release borrows the sub-plan, nests composites, and carries a
// budget the bound must fit.
plan SoftwareRelease:
  inputs:
    SourceCommit
    ReleaseVersion       [ valid_semver ]
    ReleaseApproval

  outcomes:
    DeployedRelease      [ version_matches_release_version ]

  budget: 200 person-hours

  Build: uses BuildPipeline

  Test:
    inputs:   BuildArtifacts
    outcomes: ValidatedBuild

    UnitTests:
      inputs:   BuildArtifacts
      outcomes: UnitTestResults    [ all_tests_pass ]
      estimate: 20 min

    IntegrationTests:
      inputs:   BuildArtifacts
      outcomes: IntegrationResults [ all_tests_pass ]
      estimate: 1 hour

    SmokeTests:
      inputs:   BuildArtifacts
      outcomes: SmokeResults       [ all_tests_pass ]
      estimate: 30 min

    Validate:
      inputs:   UnitTestResults, IntegrationResults, SmokeResults
      outcomes: ValidatedBuild

  ReleaseReview:
    inputs:   ValidatedBuild, ReleaseApproval
    outcomes: ApprovedRelease
    estimate: 2 hours, 2 person-hours

  Deploy:
    inputs:   ApprovedRelease
    outcomes: DeployedRelease

    StagingDeploy:
      inputs:   ApprovedRelease
      outcomes: StagedRelease
      estimate: 30 min, 1 person-hour

    StagingValidation:
      inputs:   StagedRelease
      outcomes: ValidatedStaging
      estimate: 1 hour, 2 person-hours

    Production:
      inputs:   ValidatedStaging
      outcomes: DeployedRelease

      BlueDeploy:
        inputs:   ValidatedStaging
        outcomes: BlueEnvironmentReady
        estimate: 15 min, 0.5 person-hours

      HealthCheck:
        inputs:   BlueEnvironmentReady
        outcomes: BlueHealthy [ traffic_handling_capable ]
        retry:    max 5 attempts, 30s backoff
        estimate: 10 min, 0.25 person-hours
        fails:    HealthCheckFailed

      Cutover:
        inputs:   BlueHealthy
        outcomes: DeployedRelease
        estimate: 5 min, 0.25 person-hours
        instructions:
          Switch load balancer to route 100% of traffic to blue.

      on HealthCheckFailed:
        Rollback:
          inputs:   BlueEnvironmentReady
          outcomes: DeployedRelease
          estimate: 5 min, 0.25 person-hours
          instructions:
            Tear down blue deployment, leave green serving traffic.

// Both plans built, so both checked: wiring complete and unambiguous,
// constraints compatible along every edge, no cycles, every declared
// outcome produced, every handler reachable and wired, the bound within
// the budget. Dependencies were never written; they are derived.
print(plan_show(SoftwareRelease))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 14 nodes, 10 leaves, 1 handlers

print(SoftwareRelease instanceof WellFormedPlan)
// expect: true

// Estimates roll up; the BOUND adds every recovery at its retry. A
// budget is a promise about the worst case, so the bound is what it checks.
print(estimate_show(rollup(SoftwareRelease)))
// expect: duration 440 min, effort 8.75 person-hours, money none

print(estimate_show(rollup_bound(SoftwareRelease)))
// expect: duration 1345 min, effort 24 person-hours, money none

// Where each failure goes is a property of the graph, not a comment.
print(escalations(SoftwareRelease))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

// --- Refusals a stakeholder can read -----------------------------------------
// Plans are values; the library builds them too. A plan that does not
// check yields an ERROR VALUE in planning vocabulary — every finding,
// nothing about the type system.
unwired = plan("Unwired", [port("SourceCommit")], [port("BuildArtifacts")], [
  leaf("Compile", [port("SourceCommit")], [port("CompiledBinaries")]),
  leaf("Sign", [port("PackagedArtifacts")], [port("BuildArtifacts")])])
print(error of validate(unwired))
// expect: Unwired is not well-formed: input PackagedArtifacts of Sign is not produced by any node of Unwired or by its inputs; outcome CompiledBinaries of Compile is neither consumed by a node of Unwired nor declared as its outcome

// The main graph fits in 20 person-hours; the recovery paths do not.
print(error of validate(with_budget(SoftwareRelease, effort_budget(person_hours(20)))))
// expect: SoftwareRelease is not well-formed: budget of SoftwareRelease: effort 24 person-hours exceeds 20 person-hours

// A handler nothing beneath it can raise is a finding, not dead code.
idle = plan_with_handler(unwired, handler("DiskFull", [leaf("Cleanup", [port("SourceCommit")], [port("BuildArtifacts")])]))
print(plan_errors(idle)[2])
// expect: handler on DiskFull in Unwired: no node beneath Unwired raises DiskFull

// The `plan` statement is the strict form: a plan that does not check
// HALTS the build, with the same words. Break it — change Compile's
// input above to one nothing produces:
//
//   Compile:
//     inputs:   Missing
//
//   → Type error: refinement predicate failed for WellFormedPlan:
//     BuildPipeline is not well-formed: input Missing of Compile is not
//     produced by any node of BuildPipeline or by its inputs
//
// See transcripts/01-halt.txt for the captured output.
