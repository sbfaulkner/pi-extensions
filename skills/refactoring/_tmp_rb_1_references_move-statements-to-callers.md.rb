def render_person(person)
  emit_photo_data(person[:photo])
end

def list_recent_photos(photos)
  photos.each { |p| emit_photo_data(p) }
end

def emit_photo_data(photo)
  puts "<p>title: #{photo[:title]}</p>"
  puts "<p>location: #{photo[:location]}</p>"
end
