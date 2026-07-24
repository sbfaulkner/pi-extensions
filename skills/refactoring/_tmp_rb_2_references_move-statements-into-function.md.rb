def render_person(person)
  result = []
  result << "<p>#{person[:name]}</p>"
  result << emit_photo_data(person[:photo])
  result.join("\n")
end

def emit_photo_data(photo)
  [
    "<div>title: #{photo[:title]}</div>",
    "<p>location: #{photo[:location]}</p>",
    "<p>date: #{photo[:date]}</p>",
  ].join("\n")
end
