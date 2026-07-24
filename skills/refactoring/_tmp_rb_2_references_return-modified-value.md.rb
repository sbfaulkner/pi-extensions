def total_ascent(points)
  (1...points.length).sum do |i|
    vertical = points[i][:elevation] - points[i - 1][:elevation]
    vertical.positive? ? vertical : 0
  end
end

ascent = total_ascent(points)
