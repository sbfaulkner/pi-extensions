def target_temperature(plan, current_temperature)
  [[current_temperature, plan.min].max, plan.max].min
end

target_temperature(plan, $thermostat.current_temperature)
