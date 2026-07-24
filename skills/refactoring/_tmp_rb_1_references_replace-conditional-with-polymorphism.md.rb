def plumage(bird)
  case bird[:type]
  when "EuropeanSwallow"
    "average"
  when "AfricanSwallow"
    bird[:number_of_coconuts] > 2 ? "tired" : "average"
  when "NorwegianBlueParrot"
    bird[:voltage] > 100 ? "scorched" : "beautiful"
  else
    "unknown"
  end
end
