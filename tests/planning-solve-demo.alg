// Allegro Standard — the planning DSL, choices and solution finding (B-151 stage D1)
// Solution finding is search through the space the checks constrain. The
// space is the choices (convention 13): a node that can be done one of
// several ways. A plan with open choices is a template; `solve` picks the
// options that pass every check, the budget included, best by the bound's
// effort and then its duration, and answers the solved plan with its
// decision record, or a counterexample naming the cheapest resolution.
use units
use planning

import build_pipeline

valid_semver                    = fixture("valid_semver", v => true)
version_matches_release_version = fixture("version_matches_release_version", r => true)
all_tests_pass                  = fixture("all_tests_pass", r => true)
traffic_handling_capable        = fixture("traffic_handling_capable", h => true)

// Two choices: how to test, and how to deploy. An option without ports
// takes the choice's; an option may be a leaf or a whole graph.
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
    options:
      Thorough:
        UnitTests:
          inputs:   BuildArtifacts
          outcomes: UnitTestResults    [ all_tests_pass ]
          estimate: 20 min, 0.5 person-hours
        IntegrationTests:
          inputs:   BuildArtifacts
          outcomes: IntegrationResults [ all_tests_pass ]
          estimate: 1 hour, 1 person-hour
        SmokeTests:
          inputs:   BuildArtifacts
          outcomes: SmokeResults       [ all_tests_pass ]
          estimate: 30 min, 0.5 person-hours
        Validate:
          inputs:   UnitTestResults, IntegrationResults, SmokeResults
          outcomes: ValidatedBuild
          estimate: 10 min, 0.25 person-hours
      Quick:
        estimate: 30 min, 0.5 person-hours
        instructions:
          Smoke tests only; sign off on the smoke results.

  ReleaseReview:
    inputs:   ValidatedBuild, ReleaseApproval
    outcomes: ApprovedRelease
    estimate: 2 hours, 2 person-hours

  Deploy:
    inputs:   ApprovedRelease
    outcomes: DeployedRelease
    options:
      BlueGreen:
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
          on HealthCheckFailed:
            Rollback:
              inputs:   BlueEnvironmentReady
              outcomes: DeployedRelease
              estimate: 5 min, 0.25 person-hours
      Direct:
        estimate: 6 hours, 1.5 person-hours
        instructions:
          Deploy straight to production by hand, then watch it.

// --- The template -----------------------------------------------------------
print(plan_show(SoftwareRelease))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 4 nodes, 1 leaves, 0 handlers

print(node_show(find_node(SoftwareRelease, "Deploy")))
// expect: Deploy (choice): ApprovedRelease -> DeployedRelease

print(choices(SoftwareRelease).map(c => c.name))
// expect: [Test, Deploy]

print(resolutions(SoftwareRelease).length)
// expect: 4

// The template is well-formed because some resolution fits its budget.
print(plan_errors(SoftwareRelease))
// expect: []

// --- Solving ----------------------------------------------------------------
// The objective is the bound's effort, then its duration: the cheapest
// resolution is quick tests and a slow manual deploy.
best = solve(SoftwareRelease)
print(solution_show(best))
// expect: Test via Quick, Deploy via Direct; bound effort 20.75 person-hours, duration 1460 min

// A solution's plan is a plan: the choices are gone, the checks hold.
print(plan_show(best.plan))
// expect: plan SoftwareRelease: SourceCommit, ReleaseVersion [valid_semver], ReleaseApproval -> DeployedRelease [version_matches_release_version]; 4 nodes, 3 leaves, 0 handlers

print(node_show(find_node(best.plan, "Deploy")))
// expect: Deploy (leaf): ApprovedRelease -> DeployedRelease

print(best.plan instanceof WellFormedPlan)
// expect: true

print(estimate_show(rollup_bound(best.plan)))
// expect: duration 1460 min, effort 20.75 person-hours, money none

// A deadline changes the answer: the manual deploy is too slow, so the
// search moves to blue-green and pays its effort.
on_time = with_budget(SoftwareRelease, budget(23 h, person_hours(200), none))
print(solution_show(solve(on_time)))
// expect: Test via Quick, Deploy via BlueGreen; bound effort 24.5 person-hours, duration 1265 min

// The option brings its own graph: the rollback handler comes with it.
print(handler_count(solve(on_time).plan))
// expect: 1

print(escalations(solve(on_time).plan))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

// --- Refused: no resolution fits ----------------------------------------------
// The counterexample names the cheapest resolution and the measure it
// misses. The template is not well-formed, so a `plan` statement with this
// budget would halt the build.
rushed = with_budget(SoftwareRelease, budget(21 h, person_hours(200), none))
print(plan_errors(rushed))
// expect: [no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is duration 1460 min against 21 h]

print(error of solve(with_budget(SoftwareRelease, effort_budget(person_hours(20)))))
// expect: no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is effort 20.75 person-hours against 20 person-hours

print(rushed instanceof WellFormedPlan)
// expect: false

// --- Refused: the choices themselves ------------------------------------------
// 1. An option that does not carry the choice's ports.
ship = choice("Ship", [leaf("Truck", [port("Packed")], [port("Delivered")]), leaf("Drone", [port("Packed")], [port("Dropped")])])
print(plan_errors(plan("Order", [port("Packed")], [port("Delivered")], [ship])))
// expect: [option Drone of Ship has ports Packed -> Dropped, not the choice's Packed -> Delivered]

// 2. A choice inside a recovery: a recovery is not a choice.
risky = with_failure(leaf("Pack", [port("Goods")], [port("Packed")]), "PackingError")
repack = choice("Repack", [leaf("ByHand", [port("Goods")], [port("Packed")]), leaf("ByMachine", [port("Goods")], [port("Packed")])])
guarded = plan_with_handler(plan("Fulfil", [port("Goods")], [port("Packed")], [risky]), handler("PackingError", [repack]))
print(plan_errors(guarded)[0])
// expect: handler on PackingError in Fulfil has open options; a recovery is not a choice

// 3. A plan with no choices is its own solution.
print(solution_show(solve(best.plan)))
// expect: ; bound effort 20.75 person-hours, duration 1460 min
