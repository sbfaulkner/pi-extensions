class ProductionPlan
  def initialize
    @production = 0
    @adjustments = []
  end

  def apply_adjustment(adjustment)
    @adjustments << adjustment
    @production += adjustment[:amount]
  end

  attr_reader :production
end
