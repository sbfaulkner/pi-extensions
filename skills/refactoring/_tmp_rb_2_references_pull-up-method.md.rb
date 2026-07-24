class Party
  def annual_cost
    monthly_cost * 12
  end
end

class Employee < Party; end
class Department < Party; end
