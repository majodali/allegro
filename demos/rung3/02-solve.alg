// Rung 3, scene 2 — solution finding over the model.
//
// Solution finding is search through the space the checks constrain.
// Two searches, both in the library: a CHOICE is a node that can be
// done several ways, and `solve` picks the options that pass every
// check, the budget included, best by the bound's effort and then its
// duration; a GAP is what the checks already report, and `solve_from`
// fills it from a catalog of nodes. A solved plan is a plan like any
// other, and every refusal names the cheapest candidate and why.
use units
use planning

valid_semver                    = fixture("valid_semver", v => true)
version_matches_release_version = fixture("version_matches_release_version", r => true)
all_tests_pass                  = fixture("all_tests_pass", r => true)
traffic_handling_capable        = fixture("traffic_handling_capable", h => true)
signed_and_version_stamped      = fixture("signed_and_version_stamped", a => true)
tagged_with_version             = fixture("tagged_with_version", a => true)

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

// Two choices: how to test, and how to deploy. An option without ports
// takes the choice's; an option may be a leaf or a whole graph, handlers
// included. A plan with open choices is a TEMPLATE.
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
    options:
      Thorough:
        UnitTests:
          inputs:   BuildArtifacts
          outcomes: UnitTestResults    [ all_tests_pass ]
          estimate: 20 min, 1 person-hour
        IntegrationTests:
          inputs:   BuildArtifacts
          outcomes: IntegrationResults [ all_tests_pass ]
          estimate: 1 hour, 4 person-hours
        Validate:
          inputs:   UnitTestResults, IntegrationResults
          outcomes: ValidatedBuild
      Quick:
        estimate: 30 min, 0.5 person-hours
        instructions:
          Run the smoke suite and sign off.

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
        Production:
          inputs:   StagedRelease
          outcomes: DeployedRelease
          BlueDeploy:
            inputs:   StagedRelease
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

print(choices(SoftwareRelease).map(c => c.name))
// expect: [Test, Deploy]

print(resolutions(SoftwareRelease).length)
// expect: 4

// --- Solving ----------------------------------------------------------------
// The cheapest in effort: quick tests and a slow manual deploy.
best = solve(SoftwareRelease)
print(solution_show(best))
// expect: Test via Quick, Deploy via Direct; bound effort 20.75 person-hours, duration 1460 min

// A solution's plan is a plan: the choices are gone, the checks hold.
print(best.plan instanceof WellFormedPlan)
// expect: true

// A deadline changes the answer: the manual deploy is too slow, so the
// search moves to blue-green and pays its effort — and the option brings
// its own graph, rollback handler included.
on_time = solve(with_budget(SoftwareRelease, budget(23 h, person_hours(200), none)))
print(solution_show(on_time))
// expect: Test via Quick, Deploy via BlueGreen; bound effort 22.5 person-hours, duration 1205 min

print(escalations(on_time.plan))
// expect: [CompilationError raised by Compile is handled in BuildPipeline, HealthCheckFailed raised by HealthCheck is handled in Production]

// --- Refused, with the counterexample ----------------------------------------
// No resolution fits: the cheapest is named with the measure it misses.
print(error of solve(with_budget(SoftwareRelease, budget(20 h, person_hours(200), none))))
// expect: no choice of Test and Deploy fits the budget of SoftwareRelease; the cheapest, Test via Quick, Deploy via Direct, is duration 1460 min against 20 h

// --- Completion from a catalog ------------------------------------------------
// An order to fulfil, with its last step missing: the gap is the finding
// the checks already make. A catalog of nodes fills it, chained backward
// when a node needs something too, and the completion is solved like any
// template — here the longer chain wins on effort, and the label it needs
// opens a choice of its own.
pack  = with_estimate(leaf("Pack", [port("Order")], [port("Packed")]), est(20 min, person_hours(0.5), none))
fulfil = plan("Fulfil", [port("Order")], [port("Delivered")], [pack])
print(gaps_show(fulfil))
// expect: [Delivered, which the plan declares]

label = choice("Label", [
  with_estimate(leaf("PrintLabel", [port("Packed")], [port("Labelled")]), est(5 min, person_hours(0.25), none)),
  with_estimate(leaf("HandLabel", [port("Packed")], [port("Labelled")]), est(10 min, person_hours(0.5), none))])
ship = with_estimate(leaf("Ship", [port("Packed"), port("Labelled")], [port("Shipped")]), est(120 min, person_hours(0.25), none))
last_mile = plan("LastMile", [port("Shipped")], [port("Delivered")], [
  with_estimate(leaf("Depot", [port("Shipped")], [port("Sorted")]), est(30 min, person_hours(0.25), none)),
  with_estimate(leaf("Van", [port("Sorted")], [port("Delivered")]), est(60 min, person_hours(0.5), none))])
courier = with_estimate(leaf("Courier", [port("Packed")], [port("Delivered")]), est(180 min, person_hours(1.5), none))
parts = [label, ship, last_mile, courier]

print(solution_show(solve_from(fulfil, parts)))
// expect: Delivered from LastMile, Shipped from Ship, Labelled from Label; Label via PrintLabel; bound effort 1.75 person-hours, duration 235 min

// Under a deadline the courier wins; with no way to deliver, the search
// says where it stopped.
print(solution_show(solve_from(with_budget(fulfil, budget(220 min, none, none)), parts)))
// expect: Delivered from Courier; bound effort 2 person-hours, duration 200 min

print(error of solve_from(fulfil, [last_mile, label]))
// expect: no completion of Fulfil from the catalog: nothing produces Shipped, which LastMile needs

// A template is well-formed only if SOME resolution fits its budget. Break
// it — give the release a deadline no resolution meets:
//
//   budget: 20 h, 200 person-hours
//
//   → Type error: refinement predicate failed for WellFormedPlan:
//     SoftwareRelease is not well-formed: no choice of Test and Deploy
//     fits the budget of SoftwareRelease; the cheapest, Test via Quick,
//     Deploy via Direct, is duration 1460 min against 20 h
//
// See transcripts/02-halt.txt for the captured output.
