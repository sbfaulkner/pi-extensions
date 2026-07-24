def found_person(people)
  candidates = %w[Don John Kent]
  people.find { |p| candidates.include?(p) } || ""
end
