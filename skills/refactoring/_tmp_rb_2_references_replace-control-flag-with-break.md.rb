def contains_miscreant?(people)
  people.each do |p|
    if p == "Don" || p == "John"
      send_alert
      return true
    end
  end
  false
end
