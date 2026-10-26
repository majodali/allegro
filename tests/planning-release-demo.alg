// Allegro Standard — the planning DSL's surface (B-151 stage B1)
// The worked example of docs/book/vivace/planning-dsl.md §5 as written
// there: `plan NAME:` with offside-rule blocks, the first indentation-
// delimited grammar fragment in lib/. Each `plan` statement declares its
// name as a `WellFormedPlan` binding, so a plan that does not check does
// not build. Fixtures (convention 11) are predicates in scope; `uses`
// names a plan bound earlier in the file.
use units
use planning

signed_and_version_stamped      = fixture("signed_and_version_stamped", a => true)
tagged_with_version             = fixture("tagged_with_version", a => true)
valid_semver                    = fixture("valid_semver", v => true)
version_matches_release_version = fixture("version_matches_release_version", r => true)
all_tests_pass                  = fixture("all_tests_pass", r => true)
traffic_handling_capable        = fixture("traffic_handling_capable", h => true)

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
            Raise DeploymentFailure to caller.

// Both plans built, checked and bound; the surface built the same values
// the API builds (tests/planning-handlers-demo.alg).
print(plan_show(BuildPipeline))
// expect: plan BuildPipeline: SourceCommit, ReleaseVersion -> BuildArtifacts [signed_and_version_stamped]; 3 nodes, 3 leaves, 1 handlers

print(plan_show(SoftwareRelease))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 14 nodes, 10 leaves, 1 handlers

print(SoftwareRelease instanceof WellFormedPlan)
// expect: true

print(node_show(find_node(SoftwareRelease, "HealthCheck")))
// expect: HealthCheck (leaf): BlueEnvironmentReady -> BlueHealthy [traffic_handling_capable]

print(find_node(SoftwareRelease, "HealthCheck").retry.max_attempts)
// expect: 5

print(find_node(SoftwareRelease, "HealthCheck").retry.backoff.toString())
// expect: 30 s

print(find_node(SoftwareRelease, "Cutover").instructions)
// expect: Switch load balancer to route 100% of traffic to blue.

// A handler's nodes are the handler's, not the main graph's.
print(find_node(SoftwareRelease, "Production").handlers[0].nodes[0].instructions)
// expect: Tear down blue deployment, leave green serving traffic. Raise DeploymentFailure to caller.

print(budget_show(SoftwareRelease.budget))
// expect: budget duration none, effort 200 person-hours, money none

print(estimate_show(rollup(SoftwareRelease)))
// expect: duration 440 min, effort 8.75 person-hours, money none

print(estimate_show(rollup_bound(SoftwareRelease)))
// expect: duration 1345 min, effort 24 person-hours, money none

print(escalations(SoftwareRelease))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

print(node_names(SoftwareRelease).length)
// expect: 14

print(node_names(SoftwareRelease).slice(4, 10))
// expect: [SmokeTests, Validate, ReleaseReview, Deploy, StagingDeploy, StagingValidation]
