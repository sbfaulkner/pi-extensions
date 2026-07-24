def acquire_data(input)
  input.each_line.drop(1)
       .reject { |line| line.strip.empty? }
       .map { |line| line.split(",") }
       .select { |fields| fields[0].strip == "India" }
       .map { |fields| fields[1].strip }
end
