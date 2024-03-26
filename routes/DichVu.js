var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleDichVu");//load file dboperation

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
router.get("/DichVu", function (req, res, next) {
  res.render("index", { title: "Trang Quản Lý Dịch Vụ" });
});

/*Quản lý đăng kiểm */
// lấy danh sách đăng kiểm
router.get("/getRegistry", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getRegistry')) {
      let result = await sql.getRegistry();
      result.forEach(item => {
        const date = new Date(item.NgayDangKiem);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
          const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayDangKiem = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanDangKiem == req.query.id2
          );
        });
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['NoiDangKiem', 'NguoiDiDangKiem'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              }//cột dữ liệu có cột khác string
              else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'NoiDangKiem' || sortBy === 'NguoiDiDangKiem') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá đăng kiểm
router.delete('/deleteRegistry', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteRegistry')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteRegistry(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/DangKiem/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newupload = multer({ storage: storage });
// Thêm đăng kiểm
router.post('/insertRegistry', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertRegistry')) {
    if (req.body.MaXe) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/DangKiem', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/DangKiem/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.insertRegistry(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật đăng kiểm
router.put('/updateRegistry', newupload.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateRegistry')) {
    if (req.body.MaXe && req.body.LanDangKiem) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/DangKiem', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/DangKiem/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.updateRegistry(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});


/*Quản lý phù hiệu */
// lấy danh sách phù hiệu
router.get("/getEmblem", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getEmblem')) {
      let result = await sql.getEmblem();
      result.forEach(item => {
        const date = new Date(item.NgayCapPhuHieu);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
          const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayCapPhuHieu = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanPhuHieu == req.query.id2
          );
        });
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['NoiCapPhuHieu', 'NguoiDiCapPhuHieu'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              }//cột dữ liệu có cột khác string
              else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'NoiCapPhuHieu' || sortBy === 'NguoiDiCapPhuHieu') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá phù hiệu
router.delete('/deleteEmblem', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteEmblem')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteEmblem(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

const storagePhuHieu = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/PhuHieu/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newuploadPhuHieu = multer({ storage: storagePhuHieu });
// Thêm phù hiệu
router.post('/insertEmblem', newuploadPhuHieu.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertEmblem')) {
    if (req.body.MaXe) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/PhuHieu', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/PhuHieu/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.insertEmblem(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật phù hiệu
router.put('/updateEmblem', newuploadPhuHieu.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateEmblem')) {
    if (req.body.MaXe && req.body.LanPhuHieu) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/PhuHieu', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/PhuHieu/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.updateEmblem(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});


/*Quản lý bảo hiểm */
// lấy danh sách bảo hiểm
router.get("/getInsurance", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getInsurance')) {
      let result = await sql.getInsurance();
      result.forEach(item => {
        const date = new Date(item.NgayMuaBaoHiem);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
          const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayMuaBaoHiem = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanMuaBaoHiem == req.query.id2
          );
        });
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['LoaiBaoHiem', 'NguoiMuaBaoHiem'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              }//cột dữ liệu có cột khác string
              else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'LoaiBaoHiem' || sortBy === 'NguoiMuaBaoHiem') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá bảo hiểm
router.delete('/deleteInsurance', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteInsurance')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteInsurance(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

const storageBaoHiem = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/BaoHiem/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newuploadBaoHiem = multer({ storage: storageBaoHiem });
// Thêm bảo hiểm
router.post('/insertInsurance', newuploadBaoHiem.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertInsurance')) {
    if (req.body.MaXe) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/BaoHiem', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/BaoHiem/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.insertInsurance(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật bảo hiểm
router.put('/updateInsurance', newuploadBaoHiem.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateInsurance')) {
    if (req.body.MaXe && req.body.LanMuaBaoHiem) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/BaoHiem', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/BaoHiem/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.updateInsurance(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});

/*Quản lý định vị */
// lấy danh sách định vị
router.get("/getLocate", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "MaXe"//giá trị mặc định cho cột sắp xếp
  var sortOrder = "asc"//giá trị mặc định cho thứ tự sắp xếp
  var searchExact = false//giá trị mặc định cho chế độ sắp xếp

  if (typeof req.query.sortBy !== 'undefined') {
    sortBy = req.query.sortBy
  }
  if (typeof req.query.sortOrder !== 'undefined') {
    sortOrder = req.query.sortOrder
  }
  if (typeof req.query.searchExact !== 'undefined') {
    if (req.query.searchExact === 'true') searchExact = true;
    else searchExact = false

  }
  //xử lý yêu cầu
  // Tính toán vị trí bắt đầu và kết thúc của mục trên trang hiện tại
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  try {
    if (await sql.checkSessionAndRole(ss, 'getLocate')) {
      let result = await sql.getLocate();
      result.forEach(item => {
        const date = new Date(item.NgayMua);
        const date2 = new Date(item.NgayHetHan);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
          const formattedDate2 = (`0${date2.getDate()}`).slice(-2) + '/' +
          (`0${date2.getMonth() + 1}`).slice(-2) + '/' +
          date2.getFullYear();
        item.NgayMua = formattedDate;
        item.NgayHetHan = formattedDate2;
      });
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id && typeof req.query.id2 !== 'undefined' && !isNaN(req.query.id2))) {
        const filteredData = result.filter(item => {
          return (
            item.MaXe == req.query.id &&
            item.LanMuaDinhVi == req.query.id2
          );
        });
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['NguoiMuaDinhVi'];

          // Lọc dữ liệu
          const filteredData = result.filter((row) => {
            const searchData = req.query.search;
            const searchBy = req.query.searchBy;

            // Lấy giá trị cột tìm kiếm
            const columnData = row[searchBy];

            //kiểm tra tìm kiếm chính xác
            if (searchExact) {
              // Kiểm tra xem cột có dữ liệu tiếng Việt hay không
              const isVietnameseColumn = vietnameseColumns.includes(searchBy);

              // Nếu cột là cột có dữ liệu tiếng Việt, sử dụng localeCompare để so sánh dữ liệu
              if (isVietnameseColumn) {
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData) || columnData.localeCompare(searchData, 'vi', { sensitivity: 'base' }) === 0;
                }

              } else {
                // Nếu cột không có dữ liệu tiếng Việt, chỉ kiểm tra dữ liệu bình thường
                if (typeof columnData === 'string') {
                  return columnData.includes(searchData);
                } else if (columnData !== null) {
                  return String(columnData).includes(searchData);
                }
              }
            } else {
              if (typeof columnData === 'string') {
                const lowerCaseColumnData = columnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              }//cột dữ liệu có cột khác string
              else if (typeof columnData === 'boolean' || typeof columnData === 'number') {
                const stringColumnData = String(columnData);
                const lowerCaseColumnData = stringColumnData.toLowerCase();
                const lowerCaseSearchData = searchData.toLowerCase();
                return lowerCaseColumnData.includes(lowerCaseSearchData);
              } else if (columnData !== null) {
                return false;
              }
            }



          });

          // Lưu kết quả lọc vào biến result
          result = filteredData;
        }
        //sắp xếp 
        result.sort((a, b) => {
          if (sortBy === 'NguoiMuaDinhVi') {
            // Xử lý sắp xếp cột có tiếng Việt
            const valA = a[sortBy] || ''; // Giá trị của a[sortBy] hoặc chuỗi rỗng nếu null
            const valB = b[sortBy] || ''; // Giá trị của b[sortBy] hoặc chuỗi rỗng nếu null
            if (valA === '' && valB === '') {
              return 0;
            }
            if (valA === '') {
              return 1;
            }
            if (valB === '') {
              return -1;
            }
            const comparison = valA.localeCompare(valB, 'vi', { sensitivity: 'base' });
            return sortOrder === 'asc' ? comparison : -comparison;
          } else {//cột không có tiếng Việt (chỉ có số và chữ tiếng Anh)
            if (a[sortBy] === null && b[sortBy] === null) {
              return 0;
            }
            if (a[sortBy] === null) {
              return 1;
            }
            if (b[sortBy] === null) {
              return -1;
            }
            if (a[sortBy] > b[sortBy]) {
              return sortOrder === 'asc' ? 1 : -1;
            }
            if (a[sortBy] < b[sortBy]) {
              return sortOrder === 'asc' ? -1 : 1;
            }
            return 0;
          }
        });


        //sắp xếp trước, ngắt trang sau
        const data = result.slice(startIndex, endIndex);// Lấy dữ liệu cho trang hiện tại
        if (result.length <= itemsPerPage) {
          itemsPerPage = result.length
        }

        res.status(200).json({
          currentPage,//trang hiện tại
          itemsPerPage,//số hàng trên trang
          totalItems: result.length,//tổng số dữ liệu
          totalPages: Math.ceil(result.length / itemsPerPage),//tổng số trang
          sortBy: sortBy,
          sortOrder: sortOrder,
          searchExact: searchExact,
          data,//dữ liệu trên trang hiện tại
        });
      }


    } else {
      res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá định vị
router.delete('/deleteLocate', async function (req, res, next) {
  const ss = req.headers.ss;
  const ID = req.body.ID;
  const ID2 = req.body.ID2;
  if (await sql.checkSessionAndRole(ss, 'deleteLocate')) {
    if (req.body.ID && req.body.ID2) {
      sql.deleteLocate(ID, ID2)
        .catch(error => {
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });

      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }

});

const storageDinhVi = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'img/DinhVi/'); // Thư mục lưu trữ file
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname); // Lấy phần mở rộng của file
    cb(null, file.fieldname + '-' + Date.now() + ext); // Đổi tên file và thêm phần mở rộng
  }
});
const newuploadDinhVi = multer({ storage: storageDinhVi });
// Thêm định vị
router.post('/insertLocate', newuploadDinhVi.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'insertLocate')) {
    if (req.body.MaXe) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/DinhVi', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/DinhVi/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.insertLocate(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Thêm Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi thêm dữ liệu: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
//Cập nhật định vị
router.put('/updateLocate', newuploadDinhVi.single('HinhAnh'), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  if (await sql.checkSessionAndRole(ss, 'updateLocate')) {
    if (req.body.MaXe && req.body.LanMuaDinhVi) {
      if (req.file) {
        imagePath = req.file.path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('img/DinhVi', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/DinhVi/${newPath}`;
        data = {
          ...data,
          HinhAnh:imagePathWithDomain
        }
      }
      sql.updateLocate(data)
        .then(result => {
          if (result.success) {
            res.status(200).json({ success: true, message: "Sửa Dữ Liệu Thành Công!" });
          }
        })
        .catch(error => {
          console.log("Lỗi khi cập nhật tài khoản: " + error);
          res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
        });
    } else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  } else {
    res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  }
});
module.exports = router;
