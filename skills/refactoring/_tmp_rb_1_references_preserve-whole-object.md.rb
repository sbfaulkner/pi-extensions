low = a_room[:days_temp_range][:low]
high = a_room[:days_temp_range][:high]
alerts << "room too cold" if heating_plan.within_range?(low, high) == false
