def render_person(person)
  emit_photo_data(person[:photo])
  puts "<p>location: #{person[:photo][:location]}</p>"
end

def list_recent_photos(photos)
  photos.each do |p|
    emit_photo_data(p)
    puts "<p>location: #{p[:location]}</p>"
  end
end

def emit_photo_data(photo)
  puts "<p>title: #{photo[:title]}</p>"
end
