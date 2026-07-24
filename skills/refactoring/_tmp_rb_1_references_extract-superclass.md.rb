class Employee
  def initialize(name, monthly_cost)
    @name = name
    @monthly_cost = monthly_cost
  end

  def annual_cost
    @monthly_cost * 12
  end
end

class Department
  def initialize(name, staff)
    @name = name
    @staff = staff
  end

  def monthly_cost
    @staff.sum(&:monthly_cost)
  end

  def annual_cost
    monthly_cost * 12
  end
end
