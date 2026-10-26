// Allegro Standard — the planning DSL across files (B-151 stage B2)
// The worked example split in two: `BuildPipeline` is declared in
// tests/lib/build_pipeline.alg and borrowed here with `uses` through
// `import` (convention 10). The borrowed plan arrives checked, since its
// own file declared it as a WellFormedPlan; its handler and estimates
// come with it.
use units
use planning

import build_pipeline

valid_semver                    = fixture("valid_semver", v => true)
version_matches_release_version = fixture("version_matches_release_version", r => true)
all_tests_pass                  = fixture("all_tests_pass", r => true)
traffic_handling_capable        = fixture("traffic_handling_capable", h => true)

plan SoftwareRelease:
  inputs:
    SourceCommit
    ReleaseVersion       [ valid_semver ]
    ReleaseApproval

  outcomes:
    DeployedRelease      [ version_matches_release_version ]

  budget: 200 person-hours

  Build: uses build_pipeline.BuildPipeline

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
            Raise DeploymentFailure to caller.

// The borrowed plan is the module's binding, already checked there.
print(plan_show(build_pipeline.BuildPipeline))
// expect: plan BuildPipeline: SourceCommit, ReleaseVersion -> BuildArtifacts [signed_and_version_stamped]; 3 nodes, 3 leaves, 1 handlers

print(build_pipeline.BuildPipeline instanceof WellFormedPlan)
// expect: true

// The using plan sees the same values the one-file version does.
print(plan_show(SoftwareRelease))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 14 nodes, 10 leaves, 1 handlers

print(node_show(find_node(SoftwareRelease, "Build")))
// expect: Build (uses): SourceCommit, ReleaseVersion -> BuildArtifacts [signed_and_version_stamped]

print(estimate_show(rollup(SoftwareRelease)))
// expect: duration 440 min, effort 8.75 person-hours, money none

print(estimate_show(rollup_bound(SoftwareRelease)))
// expect: duration 1345 min, effort 24 person-hours, money none

print(escalations(SoftwareRelease))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

print(unhandled_failures(SoftwareRelease))
// expect: []
