def total_salary(people)
  people.sum { |p| p[:salary] }
end

def youngest_age(people)
  people.map { |p| p[:age] }.min || Float::INFINITY
end

def salary_and_youngest(people)
  "youngest: #{youngest_age(people)}, total salary: #{total_salary(people)}"
end
