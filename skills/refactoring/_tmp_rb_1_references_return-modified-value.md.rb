def calculate_ascent(points)
  result = 0
  (1...points.length).each do |i|
    vertical = points[i][:elevation] - points[i - 1][:elevation]
    result += vertical if vertical.positive?
  end
  # ... result used below ...
end
