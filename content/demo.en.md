+++
title = "Demo"
description = "Two neural networks written by hand in JavaScript: one learns a decision boundary before your eyes, the other recognises a digit you draw."
template = "demo.html"

[extra]
eyebrow = "Demo"
heading = "Two neural networks, written by hand"
intro = "Both demos run entirely inside your browser. No data is sent anywhere, no learning library is loaded: the forward pass and backpropagation are written by hand in the two JavaScript files of this page."

lab_eyebrow = "01 · A network that learns"
lab_title = "Decision boundary, live"
lab_body = "Pick a point set, an optimiser and an architecture, then start training. The background of the map is the prediction of the network at every point of the plane: it bends at each gradient descent step. You can also click inside the map to add your own points and watch the network adapt to them."
lab_note = "Compare Adam and plain gradient descent on the spiral: on a real problem, that is the kind of gap that separates a model which converges from one you give up on."

digit_eyebrow = "02 · Digit recognition"
digit_title = "Draw a digit"
digit_body = "Sketch a digit from 0 to 9 inside the frame. The stroke is cropped, resized and recentred on its centre of mass (exactly the preprocessing of the MNIST dataset), then handed to a multilayer perceptron trained offline. The weights were quantised to 8 bits so they fit in a light file."
digit_note = "The model has never seen a mouse stroke, only scanned handwritten digits. A very thin line, a very thick one, or one stuck to the edge of the frame throws it off: that is instructive in itself."
+++
