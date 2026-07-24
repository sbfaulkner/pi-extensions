class Employee < Party; end
class Department < Party; end

class Employee
  def annual_cost
    monthly_cost * 12
  end
end

class Department
  def annual_cost
    monthly_cost * 12
  end
end
