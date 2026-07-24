def readings_outside_range(station, min, max)
  station[:readings].select { |r| r[:temp] < min || r[:temp] > max }
end

alerts = readings_outside_range(
  station,
  operating_plan[:temperature_floor],
  operating_plan[:temperature_ceiling],
)
