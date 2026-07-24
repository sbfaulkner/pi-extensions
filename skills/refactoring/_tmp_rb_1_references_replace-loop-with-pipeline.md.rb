def acquire_data(input)
  result = []
  input.each_line.with_index do |line, i|
    next if i.zero? # skip header
    next if line.strip.empty?

    fields = line.split(",")
    result << fields[1].strip if fields[0].strip == "India"
  end
  result
end
