class Account
  def initialize(type, days_overdrawn)
    @type = type
    @days_overdrawn = days_overdrawn
  end

  def bank_charge
    result = 4.5
    result += overdraft_charge if @days_overdrawn.positive?
    result
  end

  def overdraft_charge
    if @type.premium?
      base = 10
      @days_overdrawn <= 7 ? base : base + (@days_overdrawn - 7) * 0.85
    else
      @days_overdrawn * 1.75
    end
  end
end
