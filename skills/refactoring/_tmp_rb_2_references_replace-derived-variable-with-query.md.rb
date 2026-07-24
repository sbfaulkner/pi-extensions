class ProductionPlan
  def initialize
    @adjustments = []
  end

  def apply_adjustment(adjustment)
    @adjustments << adjustment
  end

  def production
    @adjustments.sum { |a| a[:amount] }
  end
end
