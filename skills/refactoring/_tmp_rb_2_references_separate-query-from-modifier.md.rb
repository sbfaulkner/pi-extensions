def find_miscreant(people)
  people.find { |p| p == "Don" || p == "John" } || ""
end

def alert_for_miscreant(people)
  send_alert unless find_miscreant(people).empty?
end

# caller
found = find_miscreant(people)
alert_for_miscreant(people)
