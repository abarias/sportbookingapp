(function () {
  const defaultEvidence = [
    "Result matches the expected wording/status",
    "No duplicate record or unexpected side effect is visible",
    "Capture a screenshot or video if the result fails"
  ];

  window.UAT_CASES = [];
  window.uatCase = function uatCase(input) {
    return {
      id: input.id,
      persona: input.persona,
      category: input.category,
      scenario: input.scenario,
      priority: input.priority,
      purpose: input.purpose,
      feature: input.feature,
      preconditions: input.preconditions ?? [],
      account: input.account,
      data: input.data ?? [],
      steps: input.steps,
      finalExpected: input.finalExpected,
      screenshots: input.screenshots ?? [],
      cleanup: input.cleanup ?? "Retain the UAT-prefixed record unless the UAT coordinator requests cleanup.",
      evidence: input.evidence ?? defaultEvidence,
      confidence: input.confidence ?? "confirmed",
      sourceEvidence: input.sourceEvidence ?? [],
      requirement: input.requirement ?? input.feature,
      tags: input.tags ?? []
    };
  };
  window.addUatCases = function addUatCases(cases) {
    window.UAT_CASES.push(...cases);
  };
})();
