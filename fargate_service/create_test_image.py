import numpy as np
import cv2

# Create a simple test image with some shapes
img = np.zeros((480, 640, 3), dtype=np.uint8)

# Add some colored rectangles that might be detected as objects
cv2.rectangle(img, (50, 50), (150, 150), (0, 255, 0), -1)  # Green rectangle
cv2.rectangle(img, (200, 200), (300, 350), (255, 0, 0), -1)  # Blue rectangle
cv2.circle(img, (450, 100), 50, (0, 0, 255), -1)  # Red circle

# Add some text
cv2.putText(img, "Test Image", (50, 400), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)

# Save the image
cv2.imwrite("sample.jpg", img)
print("Test image created successfully!")
