def raise_salary(person, factor)
  person.salary = (person.salary * (1 + factor)).round
end

raise_salary(person, 0.05)
raise_salary(person, 0.10)
