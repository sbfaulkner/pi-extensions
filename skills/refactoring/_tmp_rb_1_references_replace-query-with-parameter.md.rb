def target_temperature(plan)
  current = $thermostat.current_temperature
  [[current, plan.min].max, plan.max].min
end
