Tôi muốn xây dựng backend cho một website **Temporary Email** giống mail-temp-free.com.

Tôi **đã có sẵn toàn bộ UI HTML/CSS/JS của website**, vì vậy **không cần tạo frontend mới**, chỉ cần backend API để UI hoạt động.

# Công nghệ yêu cầu

Backend:

- Node.js
- Express.js
- Redis để lưu email tạm thời
- Socket.io để cập nhật inbox realtime
- JWT để xác thực người dùng
- Dùng JSON file để lưu cấu hình domain và user role

Mail server:

- Sử dụng mail server miễn phí hỗ trợ **Webhook nhận email** (ví dụ Mailgun free tier)

Frontend:

- Sử dụng **HTML/CSS/JS thuần đã có**
- Backend phải tạo API tương thích để frontend gọi

---

# Chức năng chính

## 1. Temporary Email

### Tạo email ngẫu nhiên

API:

GET /api/new-email

Response:

{
"email": "[abc123@domain.com](mailto:abc123@domain.com)"
}

Email sẽ được tạo random.

---

### Lấy danh sách email trong inbox

GET /api/inbox/:email

Response:

[
{
"id": "msg1",
"from": "[service@example.com](mailto:service@example.com)",
"subject": "OTP Code",
"time": "2026-01-01"
}
]

---

### Xem chi tiết email

GET /api/email/:id

Response:

{
"from": "[service@example.com](mailto:service@example.com)",
"subject": "OTP Code",
"body": "Your OTP is 123456"
}

---

### Nhận email từ mail server

Webhook:

POST /api/webhook/mail

Input:

{
"to": "[abc123@domain.com](mailto:abc123@domain.com)",
"from": "[sender@example.com](mailto:sender@example.com)",
"subject": "Verify",
"text": "123456"
}

Backend sẽ:

- parse email
- lưu vào Redis
- push realtime qua Socket.io

---

### Email tự xoá

Email sẽ tự động xoá sau **24 giờ** bằng Redis TTL.

---

# Quản lý domain

Domain được chia thành 3 cấp:

basic
premium
vip

Ví dụ:

const domains = [
{ name: "mail1.com", tier: "basic" },
{ name: "mail2.com", tier: "basic" },

{ name: "hidden1.com", tier: "premium" },
{ name: "hidden2.com", tier: "premium" },

{ name: "vip1.com", tier: "vip" }
]

---

# Quản lý người dùng

Website có hệ thống user để truy cập domain ẩn.

User role gồm:

guest
basic
premium
vip

Guest không cần đăng nhập.

---

# Phân quyền domain

Guest hoặc Basic user:

chỉ được dùng domain tier = basic

Premium user:

được dùng
basic + premium

VIP user:

được dùng
basic + premium + vip

Domain không đủ quyền **không được trả về API**.

---

# Authentication

API:

POST /api/login

Response:

{
"token": "jwt_token",
"role": "premium"
}

JWT sẽ chứa:

userId
role

---

# API domain

GET /api/domains

Backend sẽ trả về domain phù hợp với role của user.

Guest chỉ thấy basic domain.

---

# Realtime inbox

Khi email mới tới:

Socket.io emit:

event: new_email

Frontend tự động cập nhật inbox.

---

# Redis structure

email:abc123@domain.com

messages:

[
{
id,
from,
subject,
body,
time
}
]

---

# Cấu trúc project

temp-mail/

server.js
package.json

routes/
email.js
inbox.js
webhook.js
auth.js

services/
emailService.js

redis/
redisClient.js

socket/
socket.js

public/
(UI HTML đã tải từ website)

---

# Yêu cầu code

Viết đầy đủ code chạy được bao gồm:

- server.js
- Redis config
- Socket.io
- JWT authentication
- domain permission
- webhook nhận mail
- API routes

---

# Hướng dẫn chạy

npm install
node server.js

Server chạy tại:

http://localhost:3000
