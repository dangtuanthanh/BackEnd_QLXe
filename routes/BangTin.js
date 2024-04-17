var express = require('express');
const bodyParser = require('body-parser');//xử lý dữ liệu gửi lên
var router = express.Router();
const multer = require('multer');//upload
const xlsx = require('node-xlsx');
const moment = require('moment');
const path = require('path');//xử lý đường dẫn 

const sql = require("../handle/handleBangTin");//load file dboperation

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
router.get("/BangTin", function (req, res, next) {
  res.render("index", { title: "Trang Bảng Tin" });
});

/*Quản lý chủ đề */
// lấy danh sách chủ đề
router.get("/getTopic", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "TenChuDe"//giá trị mặc định cho cột sắp xếp
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
    // if (await sql.checkSessionAndRole(ss, 'getTopic')) {
      let result = await sql.getTopic();
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaChuDe == req.query.id);
        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TenChuDe'];

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
              } else if (typeof columnData === 'number') {
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
          if (sortBy === 'TenChuDe') {
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


    // } else {
    //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    // }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
//Xoá chủ đề
router.delete('/deleteTopic', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  // if (await sql.checkSessionAndRole(ss, 'deleteTopic')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deleteTopic(ID)
          .catch(error => {
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }

});
// Thêm chủ đề
router.post('/insertTopic', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  // if (await sql.checkSessionAndRole(ss, 'insertTopic')) {
    if (req.body.TenChuDe) {
      sql.insertTopic(data)
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
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }
});
//Cập nhật chủ đề
router.put('/updateTopic', async function (req, res, next) {
  const ss = req.headers.ss;
  const data = req.body;
  // if (await sql.checkSessionAndRole(ss, 'updateTopic')) {
    if (req.body.TenChuDe || req.body.MaChuDe) {
      sql.updateTopic(data)
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
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }
});

/*Quản lý đăng tin */
// lấy danh sách đăng tin
router.get("/getPost", async function (req, res, next) {
  //xử lý dữ liệu vào
  const ss = req.headers.ss;
  const currentPage = parseInt(req.query.page) || 1;//trang hiện tại
  var itemsPerPage = parseInt(req.query.limit) || 10;//số hàng trên mỗi trang
  var sortBy = "TieuDe"//giá trị mặc định cho cột sắp xếp
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
    // if (await sql.checkSessionAndRole(ss, 'getPost')) {
      let result = await sql.getPost();
      result.forEach(item => {
        const date = new Date(item.NgayDang);
        // Format date
        const formattedDate = (`0${date.getDate()}`).slice(-2) + '/' +
          (`0${date.getMonth() + 1}`).slice(-2) + '/' +
          date.getFullYear();
        item.NgayDang = formattedDate;
      });
      //kiểm tra chức năng lấy 1 vai trò
      if (typeof req.query.id !== 'undefined' && !isNaN(req.query.id)) {
        const filteredData = result.filter(item => item.MaDangTin == req.query.id);
        // //lấy danh sách file đính kèm
        // let resuiltFiles = await sql.getFiles(req.query.id);
        // const newFilteredData = {
        //   ...filteredData[0],
        //   Files: resuiltFiles
        // };

        res.status(200).json(filteredData[0])
      }
      else {
        // tính năng tìm kiếm
        if (typeof req.query.search !== 'undefined' && typeof req.query.searchBy !== 'undefined') {
          // Danh sách các cột có dữ liệu tiếng Việt
          const vietnameseColumns = ['TieuDe'];

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
              } else if (typeof columnData === 'number') {
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
          if (sortBy === 'TieuDe') {
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
    // } else {
    //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
    // }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
  }
});
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/TepBangTin/');
  },
  filename: function (req, file, cb) {
    const originalname = path.basename(file.originalname); 
    const ext = path.extname(file.originalname);
    const date = moment().format('DDMMYYYYhhmmss');
    console.log('date',date);
    cb(null, originalname + '-' + date + ext); 
  }
});
const newupload = multer({ storage: storage });
// Thêm xe
router.post('/insertPost', newupload.fields([
  { name: 'Tep' },
  { name: 'Tep2' },
  { name: 'Tep3' },
  { name: 'Tep4' }
]), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  // if (await sql.checkSessionAndRole(ss, 'insertPost')) {
    if (req.body.TieuDe && req.body.NoiDung && req.body.MaThanhVien) {
      function processImage(file) {
        // xử lý đường dẫn file
        imagePath = file[0].path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('uploads/TepBangTin', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/TepBangTin/${newPath}`;
        console.log('newPath',newPath);
        console.log('imagePathWithDomain',imagePathWithDomain);
        return imagePathWithDomain;
      }
      let sdHinh2, sdHinh3, sdHinh4
      let primaryImage = null;
      //hình 1
      if (req.files.Tep) {
        primaryImage = processImage(req.files.Tep);
      } else if (req.files.Tep2) {
        primaryImage = processImage(req.files.Tep2);
        sdHinh2 = true
      } else if (req.files.Tep3) {
        primaryImage = processImage(req.files.Tep3);
        sdHinh3 = true
      } else if (req.files.Tep4) {
        primaryImage = processImage(req.files.Tep4);
        sdHinh4 = true
      }
      //hình 2
      let Tep2 = null;
      if (req.files.Tep2 && sdHinh2 != true) {
        Tep2 = processImage(req.files.Tep2);
      } else if (req.files.Tep3 && sdHinh3 != true) {
        Tep2 = processImage(req.files.Tep3);
        sdHinh3 = true
      } else if (req.files.Tep4 && sdHinh4 != true) {
        Tep2 = processImage(req.files.Tep4);
        sdHinh4 = true
      }
      //hình 3
      let Tep3 = null;
      if (req.files.Tep3 && sdHinh3 != true) {
        Tep3 = processImage(req.files.Tep3);
        sdHinh3 = true
      } else if (req.files.Tep4 && sdHinh4 != true) {
        Tep3 = processImage(req.files.Tep4);
        sdHinh4 = true
      }
      //hình 4
      let Tep4 = null;
      if (req.files.Tep4 && sdHinh4 != true) {
        Tep4 = processImage(req.files.Tep4);
        sdHinh4 = true
      }
      data = {
        ...data,
        Tep: primaryImage ? primaryImage : null,
        Tep2: Tep2 ? Tep2 : null,
        Tep3: Tep3 ? Tep3 : null,
        Tep4: Tep4 ? Tep4 : null,
      }
      sql.insertPost(data)
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
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }
});
//Cập nhật xe
router.put('/updatePost', newupload.fields([
  { name: 'Tep' },
  { name: 'Tep2' },
  { name: 'Tep3' },
  { name: 'Tep4' }
]), async function (req, res, next) {
  const ss = req.headers.ss;
  var data = req.body;
  // if (await sql.checkSessionAndRole(ss, 'updatePost')) {
    if (req.body.MaDangTin && req.body.TieuDe && req.body.NoiDung && req.body.MaThanhVien) {
      function processImage(file) {
        // xử lý đường dẫn file
        imagePath = file[0].path
        const domain = req.headers.host;
        const newPath = imagePath ? path.relative('uploads/TepBangTin', imagePath) : null; // Đường dẫn tương đối từ img/NhanVien đến imagePath
        const imagePathWithDomain = `http://${domain}/TepBangTin/${newPath}`;
        return imagePathWithDomain;
      }
      let sdHinh2, sdHinh3, sdHinh4
      let primaryImage = req.body.Tep != 'null' ? req.body.Tep : null;
      //hình 1
      if (!req.body.Tep || req.body.Tep === 'null') {
        if (req.files.Tep) {
          primaryImage = processImage(req.files.Tep);
        } else if (req.files.Tep2) {
          primaryImage = processImage(req.files.Tep2);
          sdHinh2 = true
        } else if (req.files.Tep3) {
          primaryImage = processImage(req.files.Tep3);
          sdHinh3 = true
        } else if (req.files.Tep4) {
          primaryImage = processImage(req.files.Tep4);
          sdHinh4 = true
        }
      }
      //hình 2
      let Tep2 = req.body.Tep2 != 'null' ? req.body.Tep2 : null;
      if (!req.body.Tep2 || req.body.Tep2 === 'null') {
        if (req.files.Tep2 && sdHinh2 != true) {
          Tep2 = processImage(req.files.Tep2);
        } else if (req.files.Tep3 && sdHinh3 != true) {
          Tep2 = processImage(req.files.Tep3);
          sdHinh3 = true
        } else if (req.files.Tep4 && sdHinh4 != true) {
          Tep2 = processImage(req.files.Tep4);
          sdHinh4 = true
        }
      }
      //hình 3
      let Tep3 = req.body.Tep3 != 'null' ? req.body.Tep3 : null;
      if (!req.body.Tep3 || req.body.Tep3 === 'null') {
        if (req.files.Tep3 && sdHinh3 != true) {
          Tep3 = processImage(req.files.Tep3);
          sdHinh3 = true
        } else if (req.files.Tep4 && sdHinh4 != true) {
          Tep3 = processImage(req.files.Tep4);
          sdHinh4 = true
        }
      }
      //hình 4
      let Tep4 = req.body.Tep4 != 'null' ? req.body.Tep4 : null;
      if (!req.body.Tep4 || req.body.Tep4 === 'null') {
        if (req.files.Tep4 && sdHinh4 != true) {
          Tep4 = processImage(req.files.Tep4);
          sdHinh4 = true
        }
      }
      data = {
        ...data,
        Tep: primaryImage ? primaryImage : null,
        Tep2: Tep2 ? Tep2 : null,
        Tep3: Tep3 ? Tep3 : null,
        Tep4: Tep4 ? Tep4 : null,
      }
      sql.updatePost(data)
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
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }
});
//Xoá xe
router.delete('/deletePost', async function (req, res, next) {
  const ss = req.headers.ss;
  const IDs = req.body.IDs;
  // if (await sql.checkSessionAndRole(ss, 'deletePost')) {
    if (req.body.IDs && req.body.IDs.length > 0) {
      for (const ID of IDs) {
        sql.deletePost(ID)
          .catch(error => {
            console.log("Lỗi khi cập nhật dữ liệu: " + error);
            res.status(500).json({ success: false, message: 'Đã xảy ra lỗi trong quá trình xử lý', error: error });
          });
      }
      res.status(200).json({ success: true, message: "Xoá Dữ Liệu Thành Công!" });
    }
    else res.status(400).json({ success: false, message: "Dữ liệu gửi lên không chính xác!" });
  // } else {
  //   res.status(401).json({ success: false, message: "Đăng Nhập Đã Hết Hạn Hoặc Bạn Không Có Quyền Truy Cập!" });
  // }

});
module.exports = router;
