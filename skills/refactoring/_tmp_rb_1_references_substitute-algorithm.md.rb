def found_person(people)
  people.each do |person|
    return "Don" if person == "Don"
    return "John" if person == "John"
    return "Kent" if person == "Kent"
  end
  ""
end
