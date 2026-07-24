def distance_travelled(scenario, time)
  temp = 2 * (scenario[:primary_force] / scenario[:mass])
  primary_time = [time, scenario[:delay]].min
  result = 0.5 * temp * primary_time * primary_time

  temp = scenario[:secondary_force] / scenario[:mass]
  secondary_time = [0, time - scenario[:delay]].max
  result += primary_time * temp * secondary_time
  result
end
