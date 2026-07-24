class AccountType
  def premium?
    # ...
  end

  def overdraft_charge(days_overdrawn)
    if premium?
      base = 10
      days_overdrawn <= 7 ? base : base + (days_overdrawn - 7) * 0.85
    else
      days_overdrawn * 1.75
    end
  end
end

class Account
  def bank_charge
    result = 4.5
    result += @type.overdraft_charge(@days_overdrawn) if @days_overdrawn.positive?
    result
  end
end
