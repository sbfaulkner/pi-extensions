def rating(driver)
  more_than_five_late_deliveries?(driver) ? 2 : 1
end

def more_than_five_late_deliveries?(driver)
  driver.number_of_late_deliveries > 5
end
