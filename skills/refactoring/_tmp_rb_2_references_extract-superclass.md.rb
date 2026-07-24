class Party
  def initialize(name)
    @name = name
  end

  def annual_cost
    monthly_cost * 12
  end
end

class Employee < Party
  def initialize(name, monthly_cost)
    super(name)
    @monthly_cost = monthly_cost
  end

  attr_reader :monthly_cost
end

class Department < Party
  def initialize(name, staff)
    super(name)
    @staff = staff
  end

  def monthly_cost
    @staff.sum(&:monthly_cost)
  end
end
