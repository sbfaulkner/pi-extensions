def salary_and_youngest(people)
  youngest = people.empty? ? Float::INFINITY : people.first[:age]
  total_salary = 0
  people.each do |p|
    youngest = p[:age] if p[:age] < youngest
    total_salary += p[:salary]
  end
  "youngest: #{youngest}, total salary: #{total_salary}"
end
