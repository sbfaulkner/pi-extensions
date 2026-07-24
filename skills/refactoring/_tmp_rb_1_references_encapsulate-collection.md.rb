class Person
  def initialize
    @courses = []
  end

  # return a copy so callers can't mutate internal state
  def courses
    @courses.dup
  end

  def add_course(course)
    @courses << course
  end

  def remove_course(course)
    @courses.delete(course)
  end
end
