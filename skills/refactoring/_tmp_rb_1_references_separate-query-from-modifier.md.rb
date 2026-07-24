def alert_for_miscreant(people)
  people.each do |p|
    if p == "Don" || p == "John"
      send_alert
      return p
    end
  end
  ""
end
