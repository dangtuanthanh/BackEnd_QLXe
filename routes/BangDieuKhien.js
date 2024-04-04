var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();

const sql = require("../handle/handleBangDieuKhien");//load file xử lý

// Middleware kiểm tra và xác thực tên miền truy cập
// const checkDomainAccess = (allowedDomains) => {
//   return (req, res, next) => {
//     const domain = req.headers.origin;
//     if (allowedDomains.includes(domain)) {
//       next();
//     } else {
//       res.status(403).send('Forbidden');
//     }
//   };
// };
// app.use(checkDomainAccess(['https://your-allowed-domain.com']));

//cấu hình cors


router.use(bodyParser.json());//cho phép xử lý dữ liệu gửi lên dạng json
router.use(bodyParser.urlencoded({ extended: false }));//cho phép xử lý dữ liệu gửi lên dạng application/x-www-form-urlencoded

router.get("/BangDieuKhien", function (req, res, next) {
  res.render("index", { title: "Trang BangDieuKhien" });
});


// Lấy tổng số xe
router.get("/getTotalCar", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getDashboard')) {
      let result = await sql.getTotalCar();
      res.status(200).json(result)
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
// Lấy số tổng số thành viên
router.get("/getTotalMember", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getDashboard')) {
      let result = await sql.getTotalMember();
      res.status(200).json(result)
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
// Lấy số hợp đồng năm nay
router.get("/getYearContract", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getDashboard')) {
      let result = await sql.getYearContract();
      res.status(200).json(result)
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
// Lấy số doanh thu năm này
router.get("/getRevenueYear", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getDashboard')) {
      let result = await sql.getRevenueYear();
      res.status(200).json(result)
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});


// Lấy danh sách doanh thu năm này
router.get("/getListRevenueYear", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  try {
    if (await sql.checkSessionAndRole(ss, 'getDashboard')) {
      let result = await sql.getListRevenueYear(req.query.oldYear,req.query.year);
      res.status(200).json(result)
    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    console.log("Lỗi: " + error);
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});

module.exports = router;