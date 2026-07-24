def contains_miscreant?(people)
  found = false
  people.each do |p|
    unless found
      if p == "Don" || p == "John"
        send_alert
        found = true
      end
    end
  end
  found
end
