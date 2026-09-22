+++
title = "Demo"
description = "Two models to try in your browser: one watches a machine and flags anomalies, the other reads a digit you write by hand."
template = "demo.html"

[extra]
heading = "Two demos"
intro = "Two tools you can handle directly, of the kind I deliver. Nothing here is staged: the models compute live, from whatever you do on the page."

monitor_eyebrow = "Anomaly detection"
monitor_title = "Watching a machine that has never broken down"
monitor_body = "A machine carries a sensor that sends a reading continuously. As the page loads, the model learns what normal operation looks like: it trains itself to redraw the last forty readings, then sets its own limit beyond which the gap counts as suspect. Use the buttons to trigger a fault. It can no longer redraw what it sees, the gap widens, the alert fires — often before the curve looks wrong to the eye."
monitor_note = "The model has never seen a breakdown. It was shown nothing but normal operation, and that is precisely what makes the method usable in a factory: faults there are too rare and too varied for anyone to draw up a catalogue of them."

digit_eyebrow = "Digit recognition"
digit_title = "Draw a digit"
digit_body = "Draw a digit from 0 to 9 in the frame. The drawing is reduced to an image 28 pixels across, cropped and recentred the way the training ones were, then handed to the model. The right-hand column shows what it sees, what it answers, and the confidence it gives each digit."
digit_note = "The model has never seen a stroke drawn with a mouse. It learned on digits written with a pen and then scanned, and a stroke that is too thin or pressed against the edge of the frame gives it trouble. A model is only worth anything on data that resembles what it learned from; that limit turns up on just about every project."
+++
