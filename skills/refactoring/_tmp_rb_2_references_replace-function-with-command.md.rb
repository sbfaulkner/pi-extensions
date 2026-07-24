class Scorer
  def initialize(candidate, medical_exam, scoring_guide)
    @candidate = candidate
    @medical_exam = medical_exam
    @scoring_guide = scoring_guide
  end

  def execute
    @result = 0
    @health_level = 0
    score_smoking
    # ... extracted steps share state via instance variables ...
    @result
  end

  private

  def score_smoking
    # ...
  end
end

def score(candidate, medical_exam, scoring_guide)
  Scorer.new(candidate, medical_exam, scoring_guide).execute
end
