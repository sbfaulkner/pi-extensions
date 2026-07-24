alerts << "room too cold" unless heating_plan.within_range?(a_room[:days_temp_range])

class HeatingPlan
  def within_range?(range)
    range[:low] >= @temperature_range[:low] && range[:high] <= @temperature_range[:high]
  end
end
