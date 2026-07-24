class Reading
  def initialize(data)
    @data = data
  end

  def base_charge
    base_rate(@data[:month], @data[:year]) * @data[:quantity]
  end

  def taxable_charge
    [0, base_charge - tax_threshold(@data[:year])].max
  end
end
