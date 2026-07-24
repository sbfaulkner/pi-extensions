def distance_travelled(scenario, time)
  primary_acceleration = 2 * (scenario[:primary_force] / scenario[:mass])
  primary_time = [time, scenario[:delay]].min
  result = 0.5 * primary_acceleration * primary_time * primary_time

  secondary_acceleration = scenario[:secondary_force] / scenario[:mass]
  secondary_time = [0, time - scenario[:delay]].max
  result += primary_time * secondary_acceleration * secondary_time
  result
end
