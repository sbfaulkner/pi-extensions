# before
def reason_for_visit(patient)
  # legacy handling, no longer reachable
  if false
    log_legacy_reason(patient)
  end
  patient.chief_complaint
end

# after
def reason_for_visit(patient)
  patient.chief_complaint
end
